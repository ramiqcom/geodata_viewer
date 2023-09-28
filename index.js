// Map data
const map = L.map('map').setView([0, 117], 5);

// Tile 
L.tileLayer('http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
	attribution: 'Google Maps'
}).addTo(map);

// Loading dialog
const loading = document.getElementById('loading');
loading.style.display = 'flex';
loading.className = 'vertical';

// Data tile
const layers = document.getElementById('layers');

// Dialog div
const dialogDiv = document.getElementById('errorMsg');
dialogDiv.ondragover = () => dialogDiv.close();
dialogDiv.onclick = () => dialogDiv.close();

// Add data button
const addButton = document.getElementById('addbutton');
const uploadPanel = document.getElementById('inputdata');
addButton.onclick = () => {
	uploadPanel.showModal();
};

// Change input option
const inputOption = document.getElementById('selectinput');
inputOption.onchange = (e) => {
	const choices = [
		{ value: 'upload', id: 'upload' },
		{ value: 'text', id: 'inputtext' },
		{ value: 'url', id: 'inputurl' },
		{ value: 'ee', id: 'inputee' }
	];
	const choice = e.target.value;
	choices.map(dict => {
		const value = dict.value;
		const input = document.getElementById(dict.id);
		value == choice ? input.style.display = 'flex' : input.style.display = 'none';
	});
};

// Input text
const inputTextChoice = document.getElementById('textchoice');
const inputTextArea = document.getElementById('inputtextarea');
const inputTextButton = document.getElementById('inputtextbutton');
inputTextButton.onclick = async () => {
	// Geojson data
	let geojson;

	// Error if the text is too long
	if (inputTextArea.length > 1e6){
		errorShow('Input is too long! Only under 1 million characters are allowed!')
	}

	// Parse geojson
	try {
		switch (inputTextChoice.value){
			case 'geojson':
				geojson = JSON.parse(inputTextArea.value);
				break;
			case 'kml':
				geojson = new DOMParser().parseFromString(inputTextArea.value, 'text/xml');
				geojson = await toGeoJSON.kml(geojson);
				break;
		};
	} catch (error) {
		errorShow(error);
	};

	// Process vector layer
	processVector(geojson, `${inputTextChoice.value}_${String(new Date().getTime())}`);
};

// Input url
const inputUrlChoice = document.getElementById('urlchoice');
const inputUrlText = document.getElementById('urltext');
const inputUrlButton = document.getElementById('urlbutton');
inputUrlButton.onclick = async () => {
	try {
		switch(inputUrlChoice.value) {
			case 'tile':
				const tile = L.tileLayer(inputUrlText.value).addTo(map);
				addLayers(tile, `tile_${String(new Date().getTime())}`, null, 'tile', null, null);
				break;
			case 'file':
				let name = inputUrlText.value.split('/');
				name = name[name.length - 1];
				let file = await fetch(inputUrlText.value);
				file = await file.blob();
				file.name = name;
				loadFile(file);
		};
	} catch (error) {
		errorShow(error);
	};
}

// Close input data button
document.getElementById('closeinput').onclick = () => uploadPanel.close();

// Upload data
const uploadButton = document.getElementById('upload');
uploadButton.onchange = (e) => {
	loadFile(e.target.files[0]);
};

// On drag function
window.ondragover = e => e.preventDefault();

// On drop function
window.ondrop = async (e) => {
	// Prevent to open the file in new tab
	e.preventDefault();
	loadFile(e.dataTransfer.files[0]);
};

/**
 * Loading screen function
 * @param {Boolean} status 
 * @param {String} text 
 * @param {String | Hex} color 
 */
function setLoading(status, text, color){
	if (status) {
		loading.showModal();
		loading.style.color = color;
		loading.innerText = text;
	} else {
		loading.innerText = null;
		loading.close();
	};
}

/**
 * Function load file
 * @param {Blob} file 
 */
async function loadFile(file) {
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

/**
 * Function to load vector data
 * @param {'geojson' | 'json' | 'kmz' | 'kml' | 'zip'} format 
 * @param {Blob} file 
 */
async function vectorLayer(format, file){
	// GeoJSON file
	let geojson;

	// Set loading screen
	setLoading(true, 'Parsing file...', 'blue');

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

	// Process vector layer
	processVector(geojson, file.name)
}

/**
 * Function to process vector layer
 * @param {GeoJSON} geojson 
 * @param {String} name 
 */
function processVector(geojson, name){
	// Set loading screen to preparing tile
	setLoading(true, 'Creating tile...', 'blue');

	// Set bounds
	const bounds = L.geoJSON(geojson).getBounds();

	// Option for geojson tile
	const red = Math.floor(Math.random() * 255 * Math.random());
	const green = Math.floor(Math.random() * 255 * Math.random());
	const blue = Math.floor(Math.random() * 255 * Math.random());
	const fillColor = RGBAToHexA(red, green, blue, 0.3);
	const color = RGBAToHexA(red, green, blue, 1);
	const optionsVector = {
		maxZoom: 24,
		minZoom: 0,
		tolerance: 5,
		maxNativeZoom: 15,
		minNativeZoom: 5,
		style: { 
			color,
			fillColor,
			weight: 1, 
		}
	};

	// Vector tle
	const vectorTile = L.geoJson.vt(geojson, optionsVector).addTo(map);

	// Zoom to bounds
	map.fitBounds(bounds);

	// Set loading screen
	setLoading(true, 'Adding data...', 'blue');

	// Add layer control
	addLayers(vectorTile, name, bounds, 'vector', geojson, { color, fillColor });
}

/**
 * Function to load raster data
 * @param {Blob} file 
 */
async function rasterLayer(file){
	// Set loading screen
	setLoading(true, 'Parsing data...', 'blue');

	let imageTile = await parseGeoraster(file);

	// Set loading screen
	setLoading(true, 'Creating tile...', 'blue');

	// Create image tile
	imageTile = new GeoRasterLayer({
		georaster: imageTile,
		opacity: 1,
		resolution: 1024
	}).addTo(map);
	
	// Zoom to bounds
	const bounds = imageTile.extent.leafletBounds;
	map.fitBounds(bounds);

	// Set loading screen
	setLoading(true, 'Adding data...', 'blue');

	// Add layer control
	addLayers(imageTile, file.name, bounds, 'raster', null);
}

/**
 * Error show
 * @param {String} msg 
 */
function errorShow(msg){
	dialogDiv.innerText = msg;
	dialogDiv.showModal();
	throw new Error(msg);
}

/**
 * Function to create a layer info
 * @param {L.tileLayer | L.GridLayer} layer 
 * @param {String} name 
 * @param {L.latLngBounds=} bounds
 * @param {"vector" | "raster" | "tile"} type 
 * @param {GeoJSON=} geojson
 * @param {String= | Hex=} dictColor.color
 * @param {String= | Hex=} dictColor.fillColor
 */
function addLayers(layer, name, bounds, type, geojson, dictColor){
	// Main element
	const div = document.createElement('div');
	div.style.gap = '1%';
	div.style.justifyContent = 'space-between';
	div.style.alignContent = 'center';
	div.style.border = '0.5px solid black';
	div.style.padding = '1%';
	layers.prepend(div);
	
	// First div
	const first = document.createElement('div');
	first.className = 'smallgap';
	first.style.flex = 1;
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
	second.style.flex = 1;
	second.className = 'mediumgap';
	div.append(second);

	// Color
	if (geojson) {
		// Color label
		const colorDiv = document.createElement('input');
		colorDiv.type = 'color';
		colorDiv.value = dictColor.color.slice(0, 7);
		colorDiv.onchange = e => {
			const value = e.target.value;
			layer.options.style.color = value;
			layer.options.style.fillColor = value + (dictColor.fillColor.slice(7, 9));
			layer.redraw();
		};
		second.append(colorDiv);
	}

	// Zoom to layer
	if (bounds) {
		const zoom = document.createElement('button');
		zoom.style.flex = 1;
		zoom.onclick = () => {
			map.fitBounds(bounds);
		};
		zoom.append('Pan');
		second.append(zoom);
	}

	// Button to remove layer definetly
	const remove = document.createElement('button');
	remove.style.flex = 1;
	remove.onclick = () => {
		map.removeLayer(layer);
		div.remove();
	};
	remove.append('X');
	second.append(remove);

	// Set loading screen
	setLoading(false);

	// Close upload panel
	uploadPanel.close();
}

// Function to get hex color
function RGBAToHexA(r,g,b,a) {
  r = r.toString(16);
  g = g.toString(16);
  b = b.toString(16);
  a = Math.round(a * 255).toString(16);

  if (r.length == 1)
    r = "0" + r;
  if (g.length == 1)
    g = "0" + g;
  if (b.length == 1)
    b = "0" + b;
  if (a.length == 1)
    a = "0" + a;

  return "#" + r + g + b + a;
}