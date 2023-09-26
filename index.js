// Map data
const Map = L.map('map').setView([0, 117], 5);

// Tile 
L.tileLayer('http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
	attribution: 'Google Maps'
}).addTo(Map);

// Data tile
const layers = document.getElementById('panel');

// Dialog div
const dialogDiv = document.getElementById('errorMsg');
dialogDiv.ondragover = function(e) {
	dialogDiv.close();
};
dialogDiv.onclick = function(e) {
	dialogDiv.close();
};

// On drag function
window.ondragover = function prepare(e){
	e.preventDefault();
}

// On drop function
window.ondrop = async function loadData(e){
	e.preventDefault();

	// Get file
	const file = e.dataTransfer.files[0];

	// Get file format
	let format = file.name.split('.');
	format = format[format.length - 1];

	// Limit file size
	if (file.size > 100e6){
		errorShow('File size too big!\n Only accept file smaller than 100mb!');
	}

	// Data type
	let type;
	switch (format){
		case 'geojson':
		case 'json':
		case 'zip':
		case 'kml':
		case 'kmz':
			type = 'vector';
			break;
		case 'tiff':
		case 'tif':
			type = 'raster';
			break;
		default:
			errorShow(`.${format} is not supported!\nOnly accept .geojson, .json, .zip(shapefile), .kml, .kmz, .tiff, and .tif format`);
	}

	// Run something based on type
	switch (type) {
		case 'vector':
			await vectorLayer(format, file);
			break;
		case 'raster':
			await rasterLayer(file);
			break;
	}
}

// Function to load vector data
async function vectorLayer(format, file){
	// GeoJSON file
	let geojson;

	// Parse geojson
	switch (format) {
		case 'geojson':
		case 'json':
			geojson = JSON.parse(await file.text());
			break;
		case 'kmz':
		case 'kml':
			geojson = new DOMParser().parseFromString(await file.text(), 'text/xml');
			geojson = await toGeoJSON.kml(geojson);
			break;
		case 'zip':
			geojson = await shp(await file.arrayBuffer());
			break;
	}

	// Set bounds
	const bounds = L.geoJSON(geojson).getBounds();

	// Option for geojson tile
	const optionsVector = {
		maxZoom: 24,
		minZoom: 0,
		tolerance: 5,
		maxNativeZoom: 15,
		minNativeZoom: 5,
		debug: 0,
		style: { 
			color: 'blue', weight: 1, fillOpacity: 0.3 
		}
	};

	// Vector tle
	const vectorTile = L.geoJson.vt(geojson, optionsVector).addTo(Map);

	// Zoom to bounds
	Map.fitBounds(bounds);

	// Set data
	data = vectorTile;

	// Add layer control
	addLayers(vectorTile, file.name);
}

// Function to load raster data
async function rasterLayer(file){
	let imageTile = await parseGeoraster(file);
	imageTile = new GeoRasterLayer({
		georaster: imageTile,
		opacity: 1,
		resolution: 1024
	}).addTo(Map);
	
	const bounds = imageTile.extent.leafletBounds;

	Map.fitBounds(bounds);

	// Set data
	data = imageTile;

	// Add layer control
	addLayers(imageTile, file.name);
}

// Error show
function errorShow(msg){
	dialogDiv.innerText = msg;
	dialogDiv.showModal();
	throw new Error(msg);
}

// Function to create a div
function addLayers(layer, name){
	const div = document.createElement('div');
	div.style.display = 'flex';
	div.style.gap = '1%';
	div.style.justifyContent = 'flex-between';
	
	const check = document.createElement('input');
	check.setAttribute('type', 'checkbox');
	check.setAttribute('checked', true);
	check.onchange = e => {
		const status = e.target.checked;
		status ? layer.addTo(Map) : Map.removeLayer(layer);
	};
	div.append(check);
	
	// Name
	const label = document.createElement('div')
	label.append(name);
	div.append(label);

	// Button to remove layer definetrly
	const button = document.createElement('button');
	button.onclick = () => {
		Map.removeLayer(layer);
		div.remove();
	};
	button.append('Remove');
	div.append(button);

	layers.append(div);
}