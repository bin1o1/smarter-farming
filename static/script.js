async function updateEnvironment() {          //update environment function 
    const response = await fetch("https://api.thingspeak.com/channels/2816766/feeds.json?results=2");
    data = await response.json()
    console.log(data)
    console.log('Response status:', response.status);
    document.getElementById('temperature').textContent = data["feeds"][0]["field1"] + "°C";
    document.getElementById('humidity').textContent = data["feeds"][0]["field2"] + "%";
    document.getElementById('moisture').textContent = data["feeds"][0]["field3"] + "%";
}

async function searchCommodityPrice() {         //function to predict price. asynchronous to prevent lagging in the website. Rest of the code still runs while this executes.
    const commodity = document.getElementById('commodity-search').value.trim();     //trims the input given in the search for commodity price searchbar
    const pricePredictionSection = document.getElementById('price-prediction');     //priceprediction section to unhide it later
    const priceList = document.getElementById('price-list');            //price-list section to append data to it 
    const pricePredictionTitle = document.getElementById('price-prediction-title')      //priceprediction-title tag to change its text later

    if (!commodity) {       //if there's nothing in the input
        pricePredictionSection.style.display = 'none'       //price prediction section is made invisible
        alert('Please enter a commodity name!');        
        return;     //returns without executing rest of the function
    }

    pricePredictionSection.style.display = 'block';         //if not empty, the price prediction section is made visible
    pricePredictionTitle.textContent = `Best suggested price of ${commodity} for today:`     

    priceList.innerHTML = '';       //resets the contents of the pricelist element

    try {
        
        console.log('Fetching data for:', commodity);

        const response = await fetch(`https://smarterfarming.azurewebsites.net/predict/${encodeURIComponent(commodity)}`);         //waits for the response from the server. await keyword pauses function execution until a response is received
        
        console.log('Response status:', response.status);

        if (!response.ok) {     //if response is not okay, 
            throw new Error('Commodity not found!');        
        }

        const data = await response.json();     //data = response provided by the server parsed into a jsObject

        const dates = Object.keys(data);        //dates are the keys in the data variable
        const prices = Object.values(data);     //prices are the values in the data variable
        
        dates.forEach((date, index) => {        //for each item in the date list (+ index of that date)
            const listItem = document.createElement('li');      //creates a new list iten
            listItem.innerHTML = `<strong>${date}:</strong> Rs.${prices[index].toFixed(2)} per kg`;     //sets the innerHTML of the listitem into the given string
            priceList.appendChild(listItem);        //appends the created list item to the pricelist
        });

    } catch (error) {

        // Log the error for debugging
        // alert(error.message);

        pricePredictionTitle.textContent = error.message        //if there's any error, the price predicitiontitle's text content will show the error message instead of "predicted prices for ..."
    }
}

document.getElementById('update-environment-btn').addEventListener('click', updateEnvironment);     //checks for click on the updateenv button and triggers the updateEnvironment function if clicked
document.getElementById('search-btn').addEventListener('click', searchCommodityPrice);          


document.addEventListener("DOMContentLoaded", function () {

    async function loadCrops() {
        const response = await fetch('https://smarterfarming.azurewebsites.net/get_crops/');
        const data = await response.json();
        const cropsList = document.getElementById("crops-list");
        cropsList.innerHTML = ""; // Clear the list before adding new crops

        data.crops.forEach(crop => {
            const li = document.createElement("li");
            li.textContent = `${crop["Crop Name"]} (Planted on: ${crop["Planting Date"]}) - Harvest in: ${crop["Days Remaining"]} days`;
            // Create a delete button for each crop
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.style.marginLeft = "10px"; 
            deleteButton.style.backgroundColor = '#C41E3A'
            deleteButton.addEventListener("click", async function () {
                if (confirm(`Are you sure you want to delete ${crop["Crop Name"]}?`)) {
                    await deleteCrop(crop["Crop Name"]); // Call deleteCrop function
                    loadCrops(); // Reload the crop list
                }
            });

            li.appendChild(deleteButton); // Add the delete button to the list item
            cropsList.appendChild(li); // Append the list item to the crops list
        });
    }

    async function deleteCrop(cropName) {
        try {
            const response = await fetch(`https://smarterfarming.azurewebsites.net/delete_crop/?crop_name=${cropName}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.message) {
                alert(result.message);
            } else {
                alert("Error: " + result.error);
            }
        } catch (error) {
            console.error("Failed to delete crop:", error);
            alert("An error occurred while deleting the crop.");
        }
    }

    document.getElementById("add-crop-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        const cropName = document.getElementById("crop-name").value;
        const plantingDate = document.getElementById("planting-date").value;
        const harvestDuration = document.getElementById("harvest-duration").value;

        const response = await fetch('https://smarterfarming.azurewebsites.net/add_crop/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: cropName,
                planting_date: plantingDate,
                harvest_duration: parseInt(harvestDuration)
            })
        });

        const result = await response.json();
        if (result.message) {
            alert(result.message);
            loadCrops();
        } else {
            alert("Error: " + result.error);
        }

        document.getElementById("crop-name").value = '';
        document.getElementById("planting-date").value = '';
        document.getElementById("harvest-duration").value = '';
    });

    loadCrops(); // Load crops when the page is loaded
});



let ws = new WebSocket("wss://smarterfarming.azurewebsites.net/ws");       //establishes a websocket connection to the server

ws.onmessage = function(event) {
    console.log("Data: " + event.data);       //logging recieved messages from the websocket server
};

// to store the timers and intervals for the devices
const autoOffTimers = {};
const countdownIntervals = {};

function toggleDevice(device, checkbox) {       // Function to toggle devices
    let message = checkbox.checked ? `${device}_ON` : `${device}_OFF`;      //stores {device}_ON or _OFF in message acc to slider
    console.log(message);

    const statusList = document.getElementById('device-status-list'); // Device status updates container
    const deviceStatus = document.getElementById('device-status'); // Device status section
    const deviceHistoryList = document.getElementById('device-history-list'); // History list

    deviceStatus.style.display = 'block';       // shows the device-status container if a device is toggled on

    if (checkbox.checked) {         
        const deviceId = `device-${device}`;        // Create a unique identifier for the device

        
        if (!document.getElementById(deviceId)) {           // Check if the device is already in the list
            
            const listItem = document.createElement('li');      // Create a new list item for the device
            listItem.id = deviceId;

            const currentTime = new Date().toLocaleTimeString();        // Get the current time

            listItem.innerHTML = `
                ${device} turned ON at ${currentTime}
                <span id="time-remaining-${device}" style="margin-left: 10px; color: green; font-weight: bold;"></span>
            `;      // Set the initial text content

            statusList.appendChild(listItem);           // Append the new list item to the status list
        }

        if (autoOffTimers[device]) {        // Clear any existing auto-off timer for this device
            clearTimeout(autoOffTimers[device]);
        }
        if (countdownIntervals[device]) {      // Clear any existing countdown interval for this device
            clearInterval(countdownIntervals[device]);
        }

        // Set a new timer to turn off the device after a certain period (e.g., 5 minutes)
        const autoOffDuration = 300000; //5 mins as test
        const endTime = Date.now() + autoOffDuration;

        autoOffTimers[device] = setTimeout(() => {
            // Turn off the device
            checkbox.checked = false;
            toggleDevice(device, checkbox); // Recursively call to handle turning off
            console.log(`${device} turned OFF automatically after timeout.`);
        }, autoOffDuration);

        // Start the countdown interval for the time remaining
        const timeRemainingElement = document.getElementById(`time-remaining-${device}`);
        countdownIntervals[device] = setInterval(() => {
            const remainingTime = endTime - Date.now();
            if (remainingTime <= 0) {
                clearInterval(countdownIntervals[device]);
                timeRemainingElement.textContent = ''; // Clear the countdown when time is up
            } else {
                // Update the time remaining in minutes and seconds
                const minutes = Math.floor(remainingTime / 60000);
                const seconds = Math.floor((remainingTime % 60000) / 1000);
                timeRemainingElement.textContent = `Time remaining: ${minutes}m ${seconds}s`;
            }
        }, 1000); // Update every second
    } else {
        // Remove the device's list item if it is turned off
        const deviceItem = document.getElementById(`device-${device}`);
        if (deviceItem) {
            statusList.removeChild(deviceItem);
        }

        // Clear the auto-off timer and countdown interval if the device is manually turned off
        if (autoOffTimers[device]) {
            clearTimeout(autoOffTimers[device]);
            delete autoOffTimers[device];
        }
        if (countdownIntervals[device]) {
            clearInterval(countdownIntervals[device]);
            delete countdownIntervals[device];
        }
    }

    // Record device history
    const currentTime = new Date().toLocaleTimeString();
    if (checkbox.checked) {
        document.getElementById('device-history').style.display = 'block'
        // Add to history when the device is turned ON
        const historyItem = document.createElement('li');
        historyItem.id = `history-${device}`;
        historyItem.innerHTML = `
            ${device} turned ON at ${currentTime}
        `;
        deviceHistoryList.appendChild(historyItem);
    } else {
        // Update history when the device is turned OFF
        const historyItem = document.getElementById(`history-${device}`);
        if (historyItem) {
            historyItem.innerHTML += `
                and turned OFF at ${currentTime}
            `;
        }
    }

    // Check if the list is empty and hide the device-status section if it is
    if (statusList.children.length === 0) {
        deviceStatus.style.display = 'none'; // Hide the status section if empty
    }

    // Send the message via WebSocket
    ws.send(message);
}

// function predictDisease() {
//     console.log("Predict Disease button clicked!");  // This will log when the button is clicked.
// }

// Function to adjust camera angle
function adjustCameraAngle(angle) {
    const display = document.getElementById('camera-angle-display'); // Update the displayed value
    display.textContent = `${angle}°`;

    console.log(`Camera angle adjusted to: ${angle}°`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(`CAMERA_ANGLE:${angle}`);
    }
}

// Function to toggle the visibility of the camera angle slider
function toggleCameraAngleSlider(mode) {
    const sliderContainer = document.getElementById('camera-angle-slider-container');
    
    // If 'manual' mode is selected, show the slider
    if (mode === 'manual') {
        sliderContainer.style.display = 'block';
        console.log("Camera set to manual mode");
        if(ws && ws.readyState === WebSocket.OPEN){
            ws.send('CAMERA_MANUAL');
        }
    } else {
        sliderContainer.style.display = 'none';  // Hide slider in 'automatic' mode
        console.log('Camera set to Automatic mode')

        if(ws && ws.readyState === WebSocket.OPEN){
            ws.send('CAMERA_AUTO');
        }
    }
}

// Function to handle fertilizer button clicks
function sendFertilizerMessage(fertilizerType) {
    // Send the fertilizer type via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(fertilizerType); // Send "N", "P", or "K" based on the button clicked
        console.log(`Sent fertilizer type: ${fertilizerType}`);
    }
}

// Add event listeners for the fertilizer buttons
document.getElementById('fertilizer-n-button').addEventListener('click', () => sendFertilizerMessage('N'));
document.getElementById('fertilizer-p-button').addEventListener('click', () => sendFertilizerMessage('P'));
document.getElementById('fertilizer-k-button').addEventListener('click', () => sendFertilizerMessage('K'));


// Disease recognition (commented out)

async function predictDisease() {
    const fileInput = document.getElementById("disease-image-upload");
    const resultContainer = document.querySelector(".result-container");

    if (fileInput.files.length === 0) {
        alert("Please upload an image first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        // Send the image to the API
        const response = await fetch("https://smarterfarming.azurewebsites.net/predict", {
            method: "POST",
            body: formData
        });

        // Check if the response is valid
        const data = await response.json();

        if (data.class && data.confidence) {
            document.getElementById("disease-name").textContent = `Disease: ${data.class}`;
            document.getElementById("disease-confidence").textContent = `Confidence: ${(data.confidence * 100).toFixed(2)}%`;
            document.getElementById("disease-measures").textContent = `Suggestions: ${data.measures}`;
            // Show the result
            resultContainer.style.display = "block";
        } else {
            alert("Failed to get disease prediction.");
        }
    } catch (error) {
        console.error("Error during API request:", error);
        alert("Error occurred while predicting disease.");
    }
};


function adjustVentAngle(angle) {
    const display = document.getElementById('vent-angle-display'); // Update the displayed value
    display.textContent = `${angle}°`;

    console.log(`Vent angle adjusted to: ${angle}°`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(`VENT_ANGLE:${angle}`);
    }
}
