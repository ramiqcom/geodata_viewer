// Map data
const Map = L.map('map').setView([0, 117], 5);

// Tile 
L.tileLayer('http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
	attribution: 'Google Maps'
}).addTo(Map);

// Data tile
let data;

// Map div
const MapDiv = document.getElementById('map');

// Dialog div
const dialogDiv = document.getElementById('errorMsg');
dialogDiv.ondragover = function(e) {
	dialogDiv.close();
};
dialogDiv.onclick = function(e) {
	dialogDiv.close();
};

// On drag function
MapDiv.ondragover = function prepare(e){
	e.preventDefault();
}

// On drop function
MapDiv.ondrop = async function loadData(e){
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

	// Remove current data from map
	data ? Map.removeLayer(data) : null;;

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
}

// Error show
function errorShow(msg){
	dialogDiv.innerText = msg;
	dialogDiv.showModal();
	throw new Error(msg);
}