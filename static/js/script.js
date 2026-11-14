
"use strict";

// ======================================
// SAFE ROUTE - MAIN JAVASCRIPT
// ======================================


// ======================================
// 1. MAP INITIALIZATION
// ======================================

const map = L.map("map").setView([13.0827, 80.2707], 13);

let baseLayer;
let routeLine = null;
let startMarker = null;
let destinationMarker = null;
let currentLocationMarker = null;

let startPoint = null;
let destinationPoint = null;

let nearbyLayer = L.layerGroup().addTo(map);


// ======================================
// 2. MAP TILE LAYERS AND DARK MODE
// ======================================

let isDarkMode = false;

try {
    isDarkMode = localStorage.getItem("safeRouteTheme") === "dark";
} catch (error) {
    console.warn("Theme storage is unavailable.");
}

function setMapTheme() {
    if (baseLayer) {
        map.removeLayer(baseLayer);
    }

    if (isDarkMode) {
        baseLayer = L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            {
                attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
                maxZoom: 19
            }
        );
    } else {
        baseLayer = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution: "&copy; OpenStreetMap contributors",
                maxZoom: 19
            }
        );
    }

    baseLayer.addTo(map);
}

function updateTheme() {
    document.body.dataset.theme = isDarkMode ? "dark" : "light";

    const themeBtn = document.getElementById("themeBtn");

    if (themeBtn) {
        themeBtn.textContent = isDarkMode
            ? "☀️ Light Mode"
            : "🌙 Dark Mode";
    }

    try {
        localStorage.setItem(
            "safeRouteTheme",
            isDarkMode ? "dark" : "light"
        );
    } catch (error) {
        console.warn("Could not save theme preference.");
    }

    setMapTheme();

    setTimeout(() => map.invalidateSize(), 200);
}

updateTheme();

const themeBtn = document.getElementById("themeBtn");

if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        isDarkMode = !isDarkMode;
        updateTheme();
    });
}


// ======================================
// 3. STATUS MESSAGE
// ======================================

function showStatus(message) {
    const status = document.getElementById("statusMessage");

    if (status) {
        status.textContent = message;
    }
}


// ======================================
// 4. CLEAR ROUTE FROM MAP
// ======================================

function clearRouteDisplay() {
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    if (startMarker) {
        map.removeLayer(startMarker);
        startMarker = null;
    }

    if (destinationMarker) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
    }

    const routeInfo = document.getElementById("routeInfo");

    if (routeInfo) {
        routeInfo.textContent =
            "Select a start point and destination to see route details.";
    }
}


// ======================================
// 5. SELECT POINTS ON MAP
// ======================================

map.on("click", function (event) {

    const point = [
        event.latlng.lat,
        event.latlng.lng
    ];

    // First click or start a new route
    if (!startPoint || destinationPoint) {

        clearRouteDisplay();

        startPoint = point;
        destinationPoint = null;

        startMarker = L.marker(startPoint)
            .addTo(map)
            .bindPopup("Start Location")
            .openPopup();

        showStatus(
            "Start location selected. Now click your destination."
        );

    } else {

        // Second click
        destinationPoint = point;

        destinationMarker = L.marker(destinationPoint)
            .addTo(map)
            .bindPopup("Destination")
            .openPopup();

        getRoute();
    }
});


// ======================================
// 6. GET DRIVING ROUTE
// ======================================

async function getRoute(options = {}) {

    const saveToHistory = options.save !== false;

    if (!startPoint || !destinationPoint) {
        showStatus("Please select both locations.");
        return;
    }

    showStatus("Finding your driving route...");

    const start = `${startPoint[1]},${startPoint[0]}`;
    const end = `${destinationPoint[1]},${destinationPoint[0]}`;

    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${start};${end}?overview=full&geometries=geojson`;

    try {

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Route service unavailable");
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes.length) {
            throw new Error("No driving route found");
        }

        const route = data.routes[0];

        // Remove old route
        if (routeLine) {
            map.removeLayer(routeLine);
        }

        // Draw new route
        routeLine = L.geoJSON(route.geometry, {
            style: {
                color: "#2563eb",
                weight: 6,
                opacity: 0.85
            }
        }).addTo(map);

        map.fitBounds(routeLine.getBounds(), {
            padding: [30, 30]
        });

        const distance = (route.distance / 1000).toFixed(2);

        const duration = Math.round(route.duration / 60);

        const routeInfo = document.getElementById("routeInfo");

        if (routeInfo) {
            routeInfo.textContent =
                `Distance: ${distance} km | ` +
                `Estimated driving time: ${duration} minutes`;
        }

        showStatus("Driving route found successfully.");

        if (saveToHistory) {
            await saveRoute(
                startPoint,
                destinationPoint,
                distance,
                duration
            );
        }

    } catch (error) {

        console.error("Route error:", error);

        showStatus(
            "Could not find the route. Please check your internet connection."
        );
    }
}


// ======================================
// 7. SAVE ROUTE TO FLASK + SQLITE
// ======================================

async function saveRoute(
    start,
    destination,
    distance,
    duration
) {

    try {

        const response = await fetch("/api/routes", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                start_location: start.join(", "),
                destination: destination.join(", "),
                distance: Number(distance),
                duration: Number(duration)
            })
        });

        if (!response.ok) {
            throw new Error("Route could not be saved");
        }

        await displayHistory();

    } catch (error) {

        console.error("Database save error:", error);

        showStatus(
            "Route found, but it could not be saved to the database."
        );
    }
}


// ======================================
// 8. DISPLAY ROUTE HISTORY
// ======================================


async function displayHistory() {

    const historyList = document.getElementById("historyList");

    if (!historyList) return;

    historyList.textContent = "Loading route history...";

    try {

        const response = await fetch("/api/routes");

        if (!response.ok) {
            throw new Error("History could not be loaded");
        }

        const data = await response.json();

        // Get the routes array from the API response
        const routes = data.routes || [];

        historyList.innerHTML = "";

        if (routes.length === 0) {
            historyList.textContent = "No saved routes yet.";
            return;
        }

        routes.forEach(route => {

            const item = document.createElement("div");
            item.className = "history-item";

            const details = document.createElement("div");
            details.className = "history-details";

            const title = document.createElement("strong");

            title.textContent =
                `${route.start_location} → ${route.destination}`;

            const info = document.createElement("p");

            info.textContent =
                `${Number(route.distance).toFixed(2)} km | ` +
                `${Math.round(route.duration)} minutes`;

            const date = document.createElement("small");

            date.textContent = route.created_at
                ? `Saved: ${route.created_at}`
                : "";

            details.append(title, info, date);

            const actions = document.createElement("div");
            actions.className = "history-actions";

            const viewButton = document.createElement("button");

            viewButton.textContent = "View Route";

            viewButton.addEventListener("click", () => {
                viewSavedRoute(route);
            });

            actions.appendChild(viewButton);

            item.append(details, actions);

            historyList.appendChild(item);
        });

    } catch (error) {

        console.error("History error:", error);

        historyList.textContent =
            "Could not load history. Check the Flask server.";
    }
}



// ======================================
// 9. VIEW SAVED ROUTE
// ======================================

function viewSavedRoute(route) {

    const start = route.start_location
        .split(",")
        .map(value => Number(value.trim()));

    const destination = route.destination
        .split(",")
        .map(value => Number(value.trim()));

    if (
        start.length !== 2 ||
        destination.length !== 2 ||
        !start.every(Number.isFinite) ||
        !destination.every(Number.isFinite)
    ) {
        showStatus("This saved route has invalid coordinates.");
        return;
    }

    if (
        Math.abs(start[0]) > 90 ||
        Math.abs(destination[0]) > 90 ||
        Math.abs(start[1]) > 180 ||
        Math.abs(destination[1]) > 180
    ) {
        showStatus("This saved route has invalid coordinates.");
        return;
    }

    clearRouteDisplay();

    startPoint = start;
    destinationPoint = destination;

    startMarker = L.marker(startPoint)
        .addTo(map)
        .bindPopup("Start Location");

    destinationMarker = L.marker(destinationPoint)
        .addTo(map)
        .bindPopup("Destination");

    getRoute({ save: false });
}


// ======================================
// 10. CLEAR HISTORY
// ======================================

const clearHistoryBtn =
    document.getElementById("clearHistoryBtn");

if (clearHistoryBtn) {

    clearHistoryBtn.addEventListener("click", async () => {

        const confirmed = window.confirm(
            "Are you sure you want to clear all saved routes?"
        );

        if (!confirmed) return;

        try {

            const response = await fetch("/api/routes", {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("Could not clear history");
            }

            await displayHistory();

            showStatus("Route history cleared successfully.");

        } catch (error) {

            console.error(error);

            showStatus("Could not clear route history.");
        }
    });
}


// ======================================
// 11. LOCATION SEARCH
// ======================================

async function searchPlace() {

    const input = document.getElementById("placeInput");

    const placeName = input.value.trim();

    if (!placeName) {
        showStatus("Please enter a location.");
        return;
    }

    showStatus("Searching for location...");

    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
            `?format=jsonv2&limit=1&q=${encodeURIComponent(placeName)}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Location search unavailable");
        }

        const results = await response.json();

        if (!results.length) {
            showStatus("Location not found. Try another search.");
            return;
        }

        const place = results[0];

        const point = [
            Number(place.lat),
            Number(place.lon)
        ];

        clearRouteDisplay();

        startPoint = point;
        destinationPoint = null;

        startMarker = L.marker(point)
            .addTo(map)
            .bindPopup(place.display_name || placeName)
            .openPopup();

        map.setView(point, 15);

        showStatus(
            "Location found. Click another point on the map for destination."
        );

    } catch (error) {

        console.error("Search error:", error);

        showStatus("Location search failed. Try again later.");
    }
}

const searchBtn = document.getElementById("searchBtn");

if (searchBtn) {
    searchBtn.addEventListener("click", searchPlace);
}


// ======================================
// 12. VOICE SEARCH
// ======================================

const voiceBtn = document.getElementById("voiceBtn");

if (voiceBtn) {

    voiceBtn.addEventListener("click", () => {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {

            showStatus(
                "Voice search is not supported in this browser."
            );

            return;
        }

        const recognition = new SpeechRecognition();

        recognition.lang = "en-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            showStatus("Listening. Please speak a location.");
            voiceBtn.textContent = "🎤 Listening...";
        };

        recognition.onresult = event => {

            const spokenText =
                event.results[0][0].transcript;

            document.getElementById("placeInput").value =
                spokenText;

            showStatus(`You said: ${spokenText}`);

            searchPlace();
        };

        recognition.onerror = event => {

            console.error("Voice error:", event.error);

            showStatus(
                "Voice search failed. You can type the location instead."
            );
        };

        recognition.onend = () => {
            voiceBtn.textContent = "🎤 Voice";
        };

        recognition.start();
    });
}


// ======================================
// 13. CURRENT LOCATION
// ======================================

const locationBtn =
    document.getElementById("locationBtn");

if (locationBtn) {

    locationBtn.addEventListener("click", () => {

        if (!navigator.geolocation) {

            showStatus(
                "Your browser does not support location services."
            );

            return;
        }

        showStatus("Getting your current location...");

        navigator.geolocation.getCurrentPosition(

            position => {

                const point = [
                    position.coords.latitude,
                    position.coords.longitude
                ];

                map.setView(point, 15);

                if (currentLocationMarker) {
                    map.removeLayer(currentLocationMarker);
                }

                currentLocationMarker = L.circleMarker(point, {
                    radius: 9,
                    color: "#ffffff",
                    weight: 3,
                    fillColor: "#16a34a",
                    fillOpacity: 1
                }).addTo(map);

                currentLocationMarker.bindPopup(
                    "Your current location"
                ).openPopup();

                // Use current location as the route start
                clearRouteDisplay();

                startPoint = point;
                destinationPoint = null;

                startMarker = L.marker(point)
                    .addTo(map)
                    .bindPopup("Start Location");

                showStatus(
                    "Current location set as start. Select your destination."
                );
            },

            error => {

                console.error("Location error:", error);

                showStatus(
                    "Could not get your location. Check browser permission."
                );
            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });
}


// ======================================
// 14. FIND NEARBY HOSPITALS AND POLICE
// ======================================

async function findNearbyFacilities() {

    showStatus("Finding nearby hospitals and police stations...");

    nearbyLayer.clearLayers();

    const center = map.getCenter();

    const radius = 3000;

    const query = `
        [out:json][timeout:25];
        (
            node["amenity"~"^(hospital|police)$"]
                (around:${radius},${center.lat},${center.lng});

            way["amenity"~"^(hospital|police)$"]
                (around:${radius},${center.lat},${center.lng});

            relation["amenity"~"^(hospital|police)$"]
                (around:${radius},${center.lat},${center.lng});
        );
        out center tags;
    `;

    try {

        const response = await fetch(
            "https://overpass.private.coffee/api/interpreter",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    data: query
                })
            }
        );

        if (!response.ok) {
            throw new Error("Nearby services are unavailable");
        }

        const data = await response.json();

        let count = 0;

        data.elements.forEach(place => {

            const lat = place.lat ?? place.center?.lat;
            const lon = place.lon ?? place.center?.lon;

            if (lat == null || lon == null) {
                return;
            }

            const type = place.tags?.amenity;

            const name =
                place.tags?.name ||
                (type === "hospital"
                    ? "Hospital"
                    : "Police Station");

            const marker = L.marker([lat, lon]);

            // Build popup safely without inserting raw HTML
            const popup = document.createElement("div");

            const heading = document.createElement("strong");
            heading.textContent = name;

            const description = document.createElement("p");
            description.textContent =
                type === "hospital"
                    ? "Hospital"
                    : "Police Station";

            popup.append(heading, description);

            marker.bindPopup(popup);

            marker.addTo(nearbyLayer);

            count++;
        });

        if (count > 0) {

            showStatus(
                `Found ${count} nearby hospitals and police stations.`
            );

        } else {

            showStatus(
                "No nearby facilities found in this area."
            );
        }

    } catch (error) {

        console.error("Nearby services error:", error);

        showStatus(
            "Could not load nearby services. Please try again later."
        );
    }
}

const nearbyBtn =
    document.getElementById("nearbyBtn");

if (nearbyBtn) {
    nearbyBtn.addEventListener(
        "click",
        findNearbyFacilities
    );
}


// ======================================
// 15. INITIAL APPLICATION SETUP
// ======================================

async function initializeSafeRoute() {

    showStatus("Safe Route is ready.");

    await displayHistory();

    // Fix map display after the page finishes loading
    setTimeout(() => {
        map.invalidateSize();
    }, 300);

    console.log("Safe Route JavaScript loaded successfully.");
}

initializeSafeRoute();
