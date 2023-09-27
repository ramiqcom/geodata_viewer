// Map data
const map = L.map('map').setView([0, 117], 5);

// Tile 
L.tileLayer('http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
	attribution: 'Google Maps'
}).addTo(map);

// Data tile
const layers = document.getElementById('layers');

// Dialog table
const tabPanel = document.getElementById('table');
tabPanel.style.width = '50%';
const buttonDiv = document.createElement('div');
buttonDiv.style.display = 'flex';
buttonDiv.style.flexDirection = 'row-reverse';
const xbutton = document.createElement('button');
xbutton.onclick = () => tabPanel.close();
xbutton.append('X');
tabPanel.prepend(xbutton);
const gridDiv = document.getElementById('tablegrid');
const grid = new gridjs.Grid({
	data: [['No data']],
	columns: ['No data'],
	resizable: true,
	autoWidth: true,
	fixedHeader: true,
	search: true,
	sort: true,
	height: '40vh',
	style: {
		container: {
			fontSize: 'small'
		}
	}
});
grid.render(gridDiv);	

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
	const vectorTile = L.geoJson.vt(geojson, optionsVector).addTo(map);

	// Zoom to bounds
	map.fitBounds(bounds);

	// Set data
	data = vectorTile;

	// Add layer control
	addLayers(vectorTile, file.name, bounds, 'vector', geojson);
}

// Function to load raster data
async function rasterLayer(file){
	let imageTile = await parseGeoraster(file);
	imageTile = new GeoRasterLayer({
		georaster: imageTile,
		opacity: 1,
		resolution: 1024
	}).addTo(map);
	
	const bounds = imageTile.extent.leafletBounds;

	map.fitBounds(bounds);

	// Set data
	data = imageTile;

	// Add layer control
	addLayers(imageTile, file.name, bounds, 'raster', null);
}

// Error show
function errorShow(msg){
	dialogDiv.innerText = msg;
	dialogDiv.showModal();
	throw new Error(msg);
}

// Function to create a div
function addLayers(layer, name, bounds, type, geojson){
	// Main element
	const div = document.createElement('div');
	div.style.display = 'flex';
	div.style.gap = '1%';
	div.style.justifyContent = 'space-between';
	div.style.alignContent = 'center';
	div.style.border = '0.5px solid black';
	div.style.padding = '1%';
	layers.prepend(div);
	
	// First div
	const first = document.createElement('div');
	first.style.display = 'flex';
	first.style.gap = '5px';
	div.append(first);

	// Checkbox
	const check = document.createElement('input');
	check.setAttribute('type', 'checkbox');
	check.setAttribute('checked', true);
	check.onchange = e => {
		const status = e.target.checked;
		if (type == 'vector'){
			status ? layer.options.opacity = 1: layer.options.opacity = 0;
			layer.redraw();
		}

		if (type == 'raster'){
			status ? layer.setOpacity(1): layer.setOpacity(0);
		}
	};
	first.append(check);
	
	// Name
	const label = document.createElement('div')
	label.append(name);
	first.append(label);

	// Second div
	const second = document.createElement('div');
	second.style.display = 'flex';
	second.style.gap = '5px';
	div.append(second);

	if (geojson) {
		// Grid
		let columns = Object.keys(geojson.features[0].properties).map(key => { return { id: key, name: key} });
		let data = geojson.features.map(feat => feat.properties);
		
		// Set table data on gridjs
		if (!(columns.length && data.length)) {
			columns = ['No data'];
			data = [['No data']];
		};

		// Updata data based column and data
		grid.updateConfig({
			data,
			columns
		}).forceRender();

		// Table button
		const table = document.createElement('button');
		// Render table on click table button
		table.onclick = () => {
			tabPanel.showModal();
		};
		table.append('Table');

		// Add table button to layers
		second.append(table);	
	}

	// Zoom to layer
	const zoom = document.createElement('button');
	zoom.onclick = () => {
		map.fitBounds(bounds);
	};
	zoom.append('Pan');
	second.append(zoom);

	// Button to remove layer definetly
	const remove = document.createElement('button');
	remove.onclick = () => {
		map.removeLayer(layer);
		div.remove();
	};
	remove.append('X');
	second.append(remove);
}